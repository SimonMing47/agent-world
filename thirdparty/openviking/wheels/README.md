# OpenViking Wheelhouse

`pnpm openviking:build-binary` runs `pip` with `--no-index` and only reads wheels from this directory by default.

Populate this directory from an approved internal artifact source, or set `OPENVIKING_WHEELHOUSE_DIR` to another local wheelhouse path.
