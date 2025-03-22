#!/bin/sh
echo "Deploying to database..."
npm run deploy --production
echo "Deployment complete..."
echo "Starting server..."
npm start --production
