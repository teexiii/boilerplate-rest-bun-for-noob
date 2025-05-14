#!/bin/bash

# Pull latest code and install dependencies
git pull && bun i

# Try to delete the existing pm2 process, but don't exit if it fails
pm2 del boilerplate-bun-for-noob || true

sleep 1

# Start the process with bun as the interpreter
pm2 start --interpreter=bun index.ts --name boilerplate-bun-for-noob 

# Save the pm2 configuration
pm2 save