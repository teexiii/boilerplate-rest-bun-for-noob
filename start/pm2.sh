#!/bin/bash

# Pull latest code and install dependencies
git pull && bun i

# Try to delete the existing pm2 process, but don't exit if it fails
pm2 del boilerplate-api || true

sleep 1

npx prisma db push || true

# Start the process with bun as the interpreter
pm2 start --interpreter=bun index.ts --name boilerplate-api 

# Save the pm2 configuration
pm2 save






