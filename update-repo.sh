#!/bin/bash

if ! command -v nvm &> /dev/null
then
	echo "nvm could not be found"
	exit
fi

if ! nvm list | grep -q "v12"
then
	echo "node is not v12"
	exit
fi

# Capture the output of git pull
output=$(git pull --recurse-submodules)

# Check if the output contains "Already up to date."
if [[ $output == *"Already up to date."* ]]
then
	echo "No changes pulled from git."
	exit
else
	echo "Changes pulled from git."
	npm install
	npm run build
fi
