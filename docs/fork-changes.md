# Changes in This Fork

This isn't exhaustive, but here are some of the changes I've made to this fork:

- Only use ENV variables in `Dockerfile`

## Change Server Mode Command

Users with su access on the game server can change the current game mode with the command `/server mode <mode>`, where mode is `FFA`, `CTF`, or `BTR`.

The server will restart with the new mode.
