# Geo Story Map 0.1.3 verified

Release: https://github.com/kywk/story-map/releases/tag/0.1.3
Source tag commit: 9e1d318.
Successful CI: https://github.com/kywk/story-map/actions/runs/36260841307

CI completed install, root/package typechecks, all tests, all builds and the Obsidian
release check before generating attestations and publishing the release. Only main.js,
manifest.json and styles.css are attached.

Downloaded all three public assets to /tmp/geo-story-map-release-0.1.3. Manifest version,
minimum 1.8.0 and desktop-only metadata were verified. main.js and styles.css are
byte-identical to the previously validated 0.1.2 assets; this release changes metadata
and publication method only.

Independent gh attestation verify commands for the downloaded main.js and styles.css
both exited successfully. This release was built, attested and uploaded by CI from its
source tag. No release assets were replaced and no npm packages were republished.

The community owner still needs to select Check for new releases and scan 0.1.3.
External scanner results and community approval remain pending.
