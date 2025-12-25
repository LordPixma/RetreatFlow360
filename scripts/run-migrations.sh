#!/bin/bash
# Database migration script for RetreatFlow360
# This script runs Drizzle migrations on D1 databases

set -e

echo "========================================="
echo "RetreatFlow360 - Database Migration"
echo "========================================="
echo ""

# Check if in correct directory
if [ ! -f "package.json" ]; then
    echo "Error: Please run this script from the project root directory"
    exit 1
fi

# Ask which environment to migrate
echo "Which environment do you want to migrate?"
echo "1) Local (development)"
echo "2) Staging"
echo "3) Production"
echo "4) All"
read -p "Enter choice [1-4]: " env_choice

run_migration() {
    local env=$1
    local db_name=$2

    echo ""
    echo "========================================="
    echo "Migrating $env database: $db_name"
    echo "========================================="

    cd packages/database

    if [ "$env" == "local" ]; then
        echo "Running local migrations..."
        npm run db:generate
        npm run db:migrate
    else
        echo "Running remote migrations for $env..."

        # Generate migration SQL
        npm run db:generate

        # Apply migrations to remote database
        if [ -f "drizzle/meta/_journal.json" ]; then
            # Get all migration files
            for migration in drizzle/*.sql; do
                if [ -f "$migration" ]; then
                    echo "Applying migration: $migration"
                    npx wrangler d1 execute "$db_name" --remote --file="$migration"
                fi
            done
            echo "✅ Migrations applied successfully"
        else
            echo "⚠️  No migrations found"
        fi
    fi

    cd ../..
}

case $env_choice in
    1)
        run_migration "local" "retreatflow360-dev"
        ;;
    2)
        run_migration "staging" "retreatflow360-staging"
        ;;
    3)
        read -p "⚠️  This will migrate the PRODUCTION database. Are you sure? (yes/no): " confirm
        if [ "$confirm" == "yes" ]; then
            run_migration "production" "retreatflow360-prod"
        else
            echo "Migration cancelled"
            exit 0
        fi
        ;;
    4)
        run_migration "local" "retreatflow360-dev"
        run_migration "staging" "retreatflow360-staging"

        read -p "⚠️  Proceed with PRODUCTION migration? (yes/no): " confirm
        if [ "$confirm" == "yes" ]; then
            run_migration "production" "retreatflow360-prod"
        else
            echo "Skipping production migration"
        fi
        ;;
    *)
        echo "Invalid choice. Exiting."
        exit 1
        ;;
esac

echo ""
echo "========================================="
echo "Migration complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Verify migration in Cloudflare dashboard"
echo "2. Deploy workers to the migrated environment"
echo ""
