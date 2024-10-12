#!/bin/sh
echo "Starting server..."
npm start --production > /dev/null &
# echo "Server started, deploying..."
# npm run deploy --production
# echo "Deployment complete, keeping container alive..."
tail -f /dev/null
