# Adapter A'Space — orca (D-N053 pas F2)

**Module :** `Amdkn/orca` ← `stablyai/orca`, « Next-gen IDE for parallel
agentic development », v1.4.214 au gel.
**Gel :** `708aca6a46a09c3ad3503bd3abe0ae94b502e9a7` (2026-11-08T01:59:32Z).
**Adapter :** ce dossier, `aspace-orca-adapter/` — seul code A'Space du fork.
Le code amont est byte-identique au gel (H-F2-2).
**Licence :** MIT. **État visé :** 1 (Adapté). **Propriétaire :** cœur Buzz.
**Design :** signé Clara, 2026-11-12T17:46:09-05:00 (D-F2-1..D-F2-9).

## Formes (D-F2-1, D-F2-2, D-F2-3 — CLI d'abord, `orcad` ensuite)

- **Forme A — CLI-contrat** (`contract.json`, `launch-orca-ide.sh`) : le
  contrat porte la surface CLI documentée au gel (`out/cli/index.js`,
  `bin: orca`), exposée sous le nom **`orca-ide` sur Linux** (voir
  « Collision Linux »). Preuve : `smoke_test.sh` (`--help`,
  `--version`, `worktree list --json`).
- **Forme B — client `orcad` seul** (`protocol-proof/proof.mjs`) : l'adapter
  expose le client du protocole `orcad` (readiness, WS loopback, stop,
  idle-exit). **V5 ne lance jamais `orcad`, ne le supervise jamais, ne le
  réintroduit jamais comme service** — `orcad` ne tourne que si l'opérateur
  le lance hors V5, comme le serveur herdr (TUI) au pas F1. La preuve
  tourne contre un stub local sur `127.0.0.1`, port éphémère, jamais contre
  un `orcad` V5 ni `onorca.dev`.
- **Forme C — skills en référence versionnée (D-F2-7) :** l'adapter nomme
  les 11 skills du gel et le mécanisme version-matched (guide chargé
  depuis l'exécutable : `ORCA_CLI_COMMAND` / `orca-dev` / `orca-ide`,
  `orca skills list|get`) ; il n'embarque pas les guides complets.
  Les 11 skills du gel : `orca-cli`, `orca-computer-use`, `orca-emulator`,
  `orca-emulator-android`, `orca-jira`, `orca-linear`,
  `orca-per-workspace-env`, `orca-plugin-authoring`, `orchestration`,
  `jira-tickets`, `linear-tickets`.

## Frontières

- **Hors contrat (interdits, voir `contract.json`) :** `orchestration
  task-create/dispatch/check` pour les handoffs pleins (interdite par la
  skill elle-même) ; toute commande de mise à jour (`plugin update`,
  update manuel) ; `orca serve` / `orca open` comme service V5 ;
  `--bind 0.0.0.0`, `allowPublic`, pairing mobile ; toute exposition
  réseau non loopback.
- **Hors périmètre :** le code de l'application Electron (renderer
  12 114 fichiers, main 14 100 fichiers), l'app mobile (`mobile/`),
  les VMs cloud (`cloud/`), le navigateur embarqué (`agent-browser`),
  les plugins du catalogue.
- **Couture orca ↔ herdr actée absente (D-F2-2) :** 0 occurrence de
  `herdr` dans orca au gel ; protocoles distincts (HTTP+WS `orcad`
  contre NDJSON herdr et trames `hc`) ; PTY distincts (`node-pty`+xterm
  contre `portable-pty`). Aucun lien de code orca → herdr n'est inventé ;
  le cockpit « Herdr × Orca × T3Code » reste une juxtaposition
  déclarative, et le natif consomme les deux voies séparément.

## Collision Linux (E-F2-6)

Sur Linux, `orca` nu = le lecteur d'écran GNOME (`/usr/bin/orca`).
Hors terminaux Orca, le contrat expose **`orca-ide`, jamais `orca` nu**
(sinon la synthèse vocale démarre sur la machine de l'utilisateur).
Le lanceur est `launch-orca-ide.sh` ; la CLI construite est
`out/cli/index.js` (build CLI seule : `build:cli`, pas l'app Electron
complète).

## Télémétrie zéro (D-F2-5, H-F2-4)

- `ORCA_TELEMETRY_DISABLED=1` **et** `DO_NOT_TRACK=1` forcés par
  l'adapter (config embarquée `config.json` + lanceur), vérifiés au
  fichier : ce sont les kill switches reconnus par `resolveEnvOverride`
  dans `src/main/telemetry/consent.ts` (priorité sur tout choix stocké ;
  sans consentement explicite l'état amont est déjà `pending_banner`,
  pas de transmission).
- **Auto-update (T2) coupée par le chemin de lancement :** l'adapter
  force `autoDownload = false` et `autoInstallOnAppQuit = false`
  (config embarquée) et son chemin de lancement n'appelle jamais
  `scheduleAutomaticUpdateCheck` — le check de fond 24 h
  (`AUTO_UPDATE_CHECK_INTERVAL_MS`, `updater-scheduling.ts`) n'est
  planifié que par le processus principal Electron (`updater-setup.ts`),
  que le lanceur CLI ne démarre jamais. La commande de mise à jour
  manuelle est exclue du contrat. Vérifié par capture réseau : 0
  connexion vers les releases `stablyai/orca` (voir audit).
- **Les agents pilotés (Claude Code / Codex) gardent leurs propres
  appels réseau** (T4) : orca ne coupe pas le réseau de ses agents —
  consigné, pas hérité.
- Audit complet : `orca-TELEMETRY-AUDIT.md` (domicile V5).

## Revendication 31415 qualifiée (D-F2-6)

Le bind revendique `universal_harness_gateway_31415` +
`http://127.0.0.1:31415/v1/chat/completions` — qualifiée côté A'Space
(FreeCloud, `aspace_freecloud_gateway.py`), pas une capacité du gel :
orca ne connaît pas 31415 (0 occurrence) et ne sert rien sur ce port.
Bind re-appliqué verbatim, non modifié au pas F2.

## Divergence skills V5 vs gel (D-F2-7)

La version qui fait foi est le **stub du gel** (47 lignes, guide chargé
depuis l'exécutable, version-matched). Les 6 skills V5 (12 fichiers,
guide complet de 289 lignes, blob différent du gel) sont consignées
comme divergence dans la fiche, non alignées. Alignement V5 sur le gel
= suivi hors F2 (S-F2-5).

## Dérive (D-F2-4)

Gel tenu `708aca6`. Dérive totale mesurée à l'exécution : **1 178**
commits gel → amont HEAD `91b3f12` (2026-11-12T23:12:55Z) ; liste
exhaustive par chemin jointe à la fiche : **142 commits distincts**
(`src/cli` 115, `src/main/orcad` 39, `src/main/telemetry` 10,
`src/shared` filtré 7). Revisite par signal **quotidienne** tant que la
dérive dépasse 20 ; re-gel par amendement Clara, jamais par
fast-forward silencieux.

## Tailles (E-F2-2)

Arbre au gel ~286 Mo (292 985 Ko, 39 200 fichiers) ; dépôt objet du
fork 2 233 158 Ko (historique + ~100 branches `release-prep` héritées +
tags). Clone partiel obligatoire (`--filter=blob:none`).
Répertoires non-code exclus : `docs/assets`, `docs/site/public`,
`resources/onboarding`, `config/patches`, `src/renderer/src/i18n/locales`.

## Usage

```sh
# Construire la CLI seule (pas l'app Electron complète)
node config/scripts/workspace-package-build/build-workspace-packages.mjs
node config/scripts/cli-build/build-cli.mjs
# Lancer via l'adapter (nom Linux orca-ide, télémétrie OFF, pas d'update check)
bash aspace-orca-adapter/launch-orca-ide.sh --help
bash aspace-orca-adapter/launch-orca-ide.sh worktree list --json
# Smoke + preuve client orcad
bash aspace-orca-adapter/smoke_test.sh
node aspace-orca-adapter/protocol-proof/proof.mjs
```

`--version` sur un build CLI seul répond « Could not determine the
Orca version for this build. » (exit 1) : le lecteur de version
(`src/cli/cli-version.ts`) lit `out/package.json`, que seul le
packaging Electron complet y dépose — comportement amont, pas un
défaut de l'adapter ; le smoke l'assert tel quel.
`worktree list --json` sans runtime répond en JSON
`{"error": {"code": "runtime_unavailable", ...}}` (exit 1) — contrat
machine-readable vérifié sans runtime.
