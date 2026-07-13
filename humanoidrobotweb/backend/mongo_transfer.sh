#!/bin/bash
# mongodb transfer script for humanoidfarming database
# exports all collections to a dump folder, then can be imported on another machine

DB_NAME="humanoidfarming"
DUMP_DIR="./mongo_dump"

export_db() {
    echo "exporting $DB_NAME database..."
    mongodump --db "$DB_NAME" --out "$DUMP_DIR"
    echo "done! exported to $DUMP_DIR/"
    echo "transfer this folder to the server, then run: bash mongo_transfer.sh import"
}

import_db() {
    echo "importing $DB_NAME database..."
    mongorestore --db "$DB_NAME" "$DUMP_DIR/$DB_NAME" --drop
    echo "done! imported $DB_NAME database."
}

case "$1" in
    export)
        export_db
        ;;
    import)
        import_db
        ;;
    *)
        echo "usage: bash mongo_transfer.sh [export|import]"
        echo ""
        echo "  export  - dump the database to ./mongo_dump/"
        echo "  import  - restore the database from ./mongo_dump/"
        echo ""
        echo "steps:"
        echo "  1. on your mac:    bash mongo_transfer.sh export"
        echo "  2. copy mongo_dump/ folder to the server"
        echo "  3. on the server:  bash mongo_transfer.sh import"
        ;;
esac
