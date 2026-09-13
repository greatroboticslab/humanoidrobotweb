#!/usr/bin/env bash
#
# Keeps the Humanoid Farming site online.
#
# Checks that Flask is answering and that the ngrok tunnel is connected, and
# restarts whichever one is down. Safe to run repeatedly: when everything is
# healthy it does nothing. Intended to be driven by cron, both on a schedule
# and at boot.
#
#   crontab -e
#   @reboot sleep 60 && /data/Zainab/humanoidrobotweb/keep_site_up.sh
#   */5 * * * * /data/Zainab/humanoidrobotweb/keep_site_up.sh
#
# Logs what it did to watchdog.log next to this script.

set -uo pipefail

# ---- settings -------------------------------------------------------------
PROJECT="/data/Zainab/humanoidrobotweb"
BACKEND="$PROJECT/humanoidrobotweb/backend"
PORT=8420
DOMAIN="endurance-cylinder-component.ngrok-free.dev"
SESSION="site"
CONDA_SH="/home/mtsu/miniconda3/etc/profile.d/conda.sh"
CONDA_ENV="zainab-humanoid"

# seconds to wait after starting flask before considering it up. the whisper
# model has to load first, so this is deliberately generous.
FLASK_BOOT_WAIT=60
NGROK_BOOT_WAIT=10
# ---------------------------------------------------------------------------

LOG="$PROJECT/watchdog.log"
log() { echo "$(date '+%Y-%m-%d %H:%M:%S')  $*" >> "$LOG"; }

# cron runs with a minimal PATH, so make sure tmux/curl/conda are reachable
export PATH="/usr/local/bin:/usr/bin:/bin:/home/mtsu/miniconda3/condabin:$PATH"

flask_up() {
  curl -fsS --max-time 10 "http://127.0.0.1:$PORT/api/stats" >/dev/null 2>&1
}

# ngrok exposes a local admin api; if our domain shows up there, the tunnel
# is connected. checking the public url instead would also test the internet.
ngrok_up() {
  curl -fsS --max-time 10 "http://127.0.0.1:4040/api/tunnels" 2>/dev/null \
    | grep -q "$DOMAIN"
}

ensure_session() {
  if ! tmux has-session -t "$SESSION" 2>/dev/null; then
    log "no tmux session, creating '$SESSION'"
    tmux new-session -d -s "$SESSION" -n main
    tmux split-window -v -t "$SESSION:main"
  fi
}

# pane 0 = flask, pane 1 = ngrok
run_in_pane() {
  local pane="$1" cmd="$2"
  tmux send-keys -t "$SESSION:main.$pane" C-c 2>/dev/null
  sleep 2
  tmux send-keys -t "$SESSION:main.$pane" "$cmd" C-m
}

start_flask() {
  run_in_pane 0 "cd '$BACKEND' && source '$CONDA_SH' && conda activate $CONDA_ENV && PORT=$PORT FLASK_DEBUG=0 python app.py"
}

start_ngrok() {
  run_in_pane 1 "source '$CONDA_SH' && conda activate $CONDA_ENV && ngrok http --url=$DOMAIN $PORT"
}

# ---------------------------------------------------------------------------

ensure_session

restarted=0

if ! flask_up; then
  log "flask not responding on $PORT, restarting"
  start_flask
  restarted=1
  sleep "$FLASK_BOOT_WAIT"
  if flask_up; then
    log "flask is back up"
  else
    log "flask still down after ${FLASK_BOOT_WAIT}s - check the pane by hand"
  fi
fi

# always check ngrok after flask: restarting flask does not break the tunnel,
# but a tunnel pointing at a dead backend serves 502s, so it is worth
# confirming both are healthy together.
if ! ngrok_up; then
  log "ngrok tunnel down, restarting"
  start_ngrok
  restarted=1
  sleep "$NGROK_BOOT_WAIT"
  if ngrok_up; then
    log "tunnel is back up"
  else
    log "tunnel still down - free ngrok allows one agent at a time, so check"
    log "  whether another ngrok is running elsewhere (e.g. on a laptop)"
  fi
fi

[ "$restarted" -eq 0 ] && exit 0
exit 0
