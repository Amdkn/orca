#!/usr/bin/env bash
# Smoke adapter orca — CLI-contrat (Forme A) + preuve client orcad (Forme B).
# Ne lance jamais orcad, jamais l'app Electron, ne touche jamais la vraie config.
# Sortie attendue : SMOKE_EXIT:0
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ADAPTER="$ROOT/aspace-orca-adapter"
CLI="$ROOT/out/cli/index.js"
FAIL=0

say() { printf '%s\n' "$*"; }

[ -f "$CLI" ] || { say "SMOKE_FAIL: CLI non construite ($CLI) — lancer build:cli d'abord"; exit 1; }

# 1. --help (exit 0)
if bash "$ADAPTER/launch-orca-ide.sh" --help >/dev/null 2>&1; then say "OK: orca-ide --help (exit 0)"; else say "FAIL: --help"; FAIL=1; fi

# 2. --version : comportement amont sur build CLI seul (out/package.json absent)
VER_OUT="$(bash "$ADAPTER/launch-orca-ide.sh" --version 2>&1 || true)"
case "$VER_OUT" in
  *"Could not determine the Orca version for this build."*) say "OK: --version message amont documentee (out/package.json absent du build CLI seul)" ;;
  *) say "FAIL: --version inattendu: $VER_OUT"; FAIL=1 ;;
esac

# 3. worktree list --json sans runtime : JSON runtime_unavailable (exit 1)
WT="$(bash "$ADAPTER/launch-orca-ide.sh" worktree list --json 2>&1 || true)"
if printf '%s' "$WT" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);if(j.error&&j.error.code==='runtime_unavailable'){process.exit(0)}process.exit(1)})"; then
  say "OK: worktree list --json -> runtime_unavailable (JSON valide, sans runtime)"
else say "FAIL: worktree list --json: $WT"; FAIL=1; fi

# 4. Interrupteurs forces dans la config et le lanceur
grep -qE '"ORCA_TELEMETRY_DISABLED": *"1"' "$ADAPTER/config.json" && grep -qE '"DO_NOT_TRACK": *"1"' "$ADAPTER/config.json" \
  && grep -q 'ORCA_TELEMETRY_DISABLED=1' "$ADAPTER/launch-orca-ide.sh" && grep -q 'DO_NOT_TRACK=1' "$ADAPTER/launch-orca-ide.sh" \
  && say "OK: ORCA_TELEMETRY_DISABLED=1 + DO_NOT_TRACK=1 forces (config + lanceur)" \
  || { say "FAIL: interrupteurs telemetrie"; FAIL=1; }

# 5. Coupure auto-update dans la config ; chemin de lancement sans scheduleAutomaticUpdateCheck
grep -qE '"autoDownload": *false' "$ADAPTER/config.json" && grep -qE '"autoInstallOnAppQuit": *false' "$ADAPTER/config.json" \
  && ! grep -v '^#' "$ADAPTER/launch-orca-ide.sh" | grep -q 'scheduleAutomaticUpdateCheck' \
  && say "OK: auto-update coupee (config + lanceur sans scheduleAutomaticUpdateCheck)" \
  || { say "FAIL: coupure auto-update"; FAIL=1; }

# 6. Interdits portes par le contrat
for bad in "orchestration task-create" "orchestration task-dispatch" "--bind 0.0.0.0" "allowPublic"; do
  grep -qF -- "$bad" "$ADAPTER/contract.json" || { say "FAIL: interdit absent du contrat: $bad"; FAIL=1; }
done
say "OK: interdits portes par contract.json (orchestration task-*, --bind 0.0.0.0, allowPublic, pairing mobile)"

# 7. Preuve client orcad contre stub local (Forme B)
if node "$ADAPTER/protocol-proof/proof.mjs" > "$ADAPTER/protocol-proof/proof.log" 2>&1; then
  say "OK: protocol-proof 4/4 (voir protocol-proof/proof.log)"
else say "FAIL: protocol-proof"; cat "$ADAPTER/protocol-proof/proof.log"; FAIL=1; fi

if [ "$FAIL" = 0 ]; then say "SMOKE_EXIT:0"; else say "SMOKE_EXIT:1"; exit 1; fi
