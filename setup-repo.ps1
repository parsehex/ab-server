#!/usr/bin/env pwsh

# is nvm installed?
if (-not (Get-Command nvm -ErrorAction SilentlyContinue)) {
	Write-Output "nvm could not be found"
	exit
}

# is node v12 installed?
$nvmList = nvm list
if ($nvmList -notmatch "v12") {
	Write-Output "node is not v12"
	exit
}

git pull --recurse-submodules

# node_modules?
if (-Not (Test-Path -Path "node_modules")) {
	npm install
}

if (-Not (Test-Path -Path ".env")) {
	Copy-Item -Path ".env.example" -Destination ".env"
	Write-Output ".env created - please run the following to edit:"
	Write-Output "notepad .env"
}
