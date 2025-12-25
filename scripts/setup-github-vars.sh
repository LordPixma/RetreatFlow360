#!/bin/bash
# Setup GitHub variables for RetreatFlow360
# This script requires the GitHub CLI (gh) to be installed

set -e

echo "========================================="
echo "RetreatFlow360 - GitHub Variables Setup"
echo "========================================="
echo ""

# Check if gh is installed
if ! command -v gh &> /dev/null; then
    echo "Error: GitHub CLI (gh) not found."
    echo "Please install it from: https://cli.github.com/"
    exit 1
fi

# Check if user is authenticated
if ! gh auth status &> /dev/null; then
    echo "Error: Not authenticated with GitHub."
    echo "Please run: gh auth login"
    exit 1
fi

# Get the repository (assumes we're in the repo directory)
REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo "")

if [ -z "$REPO" ]; then
    echo "Error: Not in a GitHub repository directory."
    echo "Please run this script from your RetreatFlow360 repository."
    exit 1
fi

echo "Repository: $REPO"
echo ""

# Set staging API URL
STAGING_API_URL="https://retreatflow360-api-staging.samuel-1e5.workers.dev"
echo "Setting STAGING_API_URL = $STAGING_API_URL"
gh variable set STAGING_API_URL --body "$STAGING_API_URL"

# Set production API URL
PRODUCTION_API_URL="https://retreatflow360-api.samuel-1e5.workers.dev"
echo "Setting PRODUCTION_API_URL = $PRODUCTION_API_URL"
gh variable set PRODUCTION_API_URL --body "$PRODUCTION_API_URL"

echo ""
echo "========================================="
echo "GitHub Variables configured successfully!"
echo "========================================="
echo ""
echo "Variables set:"
echo "  - STAGING_API_URL: $STAGING_API_URL"
echo "  - PRODUCTION_API_URL: $PRODUCTION_API_URL"
echo ""
echo "You can view all variables with:"
echo "  gh variable list"
echo ""
