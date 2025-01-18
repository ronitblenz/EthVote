#!/bin/bash

# Install dependencies
npm install

# Check Truffle version
truffle version

# Compile contracts
truffle compile

# Migrate contracts
truffle migrate

# Start development server
npm run dev
