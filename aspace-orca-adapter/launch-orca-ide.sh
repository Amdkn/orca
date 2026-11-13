#!/usr/bin/env bash
# Lanceur adapter orca — nom Linux orca-ide (jamais orca nu : lecteur d'ecran GNOME).
# Pose les interrupteurs telemetrie et execute la CLI construite (out/cli/index.js).
# Ne demarre jamais le processus principal Electron : aucun scheduleAutomaticUpdateCheck,
# aucun check de fond 24 h, aucune mise a jour. Ne lance jamais orcad comme service V5.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export ORCA_TELEMETRY_DISABLED=1
export DO_NOT_TRACK=1
exec node "$ROOT/out/cli/index.js" "$@"
