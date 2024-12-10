#!/usr/bin/env pwsh

if (-not (Get-Command nvm -ErrorAction SilentlyContinue)) {
	Write-Host "nvm could not be found"
	exit
}

$nvmList = nvm list
if ($nvmList -notmatch "v12") {
	Write-Host "node is not v12"
	exit
}

$gitPullOutput = git pull --recurse-submodules
if ($gitPullOutput -notmatch "Already up to date.") {
	Write-Host "Changes pulled from git"
	npm install
	npm run build
} else {
	Write-Host "No changes pulled from git"
}
