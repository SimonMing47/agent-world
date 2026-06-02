# OpenViking Third-Party Binary

AgentWorld integrates OpenViking through a direct server binary.

Expected current-platform source install path:

```text
thirdparty/openviking/bin/openviking-server-${platform}-${arch}
```

Expected Linux packaging paths:

```text
thirdparty/openviking/bin/openviking-server-linux-x64
thirdparty/openviking/bin/openviking-server-linux-arm64
thirdparty/openviking/bin/openviking-server-linux-${arch}.xz
thirdparty/openviking/bin/openviking-server-linux-${arch}.xz.part-*
```

The binary is treated as a third-party artifact from OpenViking and is not part of AgentWorld source code. The upstream project is AGPL-3.0.

Operational rules:

- Prefer `OPENVIKING_SERVER_BIN` when the binary is installed outside the repository.
- Prefer `thirdparty/openviking/bin/openviking-server-${platform}-${arch}` for source installs.
- Build the Linux binary with `pnpm openviking:build-binary` on a matching Linux builder using `thirdparty/openviking/wheels`, or place an approved compatible binary/archive at `thirdparty/openviking/bin/openviking-server-linux-${arch}`.
- Use `.xz.part-*` split archives when the raw binary is too large for repository hosting. AgentWorld joins and expands those parts locally before packaging or starting OpenViking.
- Do not require a container runtime for production deployment.

Compatibility notes:

- The bundled Linux OpenViking binaries require glibc 2.35 or newer. On older hosts, AgentWorld skips launcher-managed OpenViking startup instead of repeatedly spawning a binary that exits with a `GLIBC_2.35 not found` loader error.
- For older Linux distributions, set `OPENVIKING_SERVER_BIN` to an OpenViking binary built on that target, point `OPENVIKING_BASE_URL` at a compatible remote OpenViking service, or set `AGENTWORLD_OPENVIKING_AUTO_START=0` and manage OpenViking separately.
- Set `OPENVIKING_SKIP_GLIBC_CHECK=1` only when you have independently verified the configured binary is compatible.
