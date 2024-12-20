#!/usr/bin/env bash

# is nvm installed?
if ! command -v nvm &> /dev/null; then
	echo "nvm could not be found"
	exit 1
fi

# is node v12 installed?
if ! nvm list | grep -q "v12"; then
	echo "node is not v12"
	exit 1
fi

git pull --recurse-submodules

# node_modules?
if [ ! -d "node_modules" ]; then
	npm install
fi

if [ ! -f ".env" ]; then
	cp ".env.example" ".env"
	echo ".env created - please run the following to edit:"
	echo "notepad .env"
fi
