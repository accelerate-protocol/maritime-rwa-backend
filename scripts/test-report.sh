#/bin/bash
unset npm_config_prefix
export LC_ALL=C
export LANG=C
export NODEJS_VER=20


export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] || curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
# Get absolute path of the script's directory, then go to parent
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

# Function to clean up the background node
cleanup() {
    echo "Cleaning up background processes..."
    # Kill all child processes of the current script
    pkill -P $$ 2>/dev/null
    exit
}
# Set up signal traps for graceful cleanup
trap cleanup SIGINT SIGTERM

nvm which $NODEJS_VER &>/dev/null  || nvm install $NODEJS_VER
nvm use $NODEJS_VER

echo "*** Test begin "$(date -u)
echo "*** Repository "$(git remote get-url origin | sed 's/.*\/\([^\/]*\)\.git$/\1/')
echo "*** Branch "$(git rev-parse --abbrev-ref HEAD)
echo "*** Commit hash "$(git log --pretty=format:'%H' -n1)
echo
echo "*** Starting node"
npx hardhat node > node.log 2>&1 &

sleep 5

# Run the tests
npx hardhat test --network localhost

cleanup
echo "*** Test end "$(date -u)

