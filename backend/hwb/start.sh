#!/bin/sh
# Start the server
npm start &
# Your additional command here
sleep 5
npm run deploy
# Keep the container running
wait
