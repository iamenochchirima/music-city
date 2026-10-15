import {
  defineRailway,
  github,
  postgres,
  project,
  service,
  volume,
} from "railway/iac";

export default defineRailway(() => {
  const Postgres = postgres("Postgres", { region: "asia-southeast1-eqsg3a" });
  Postgres.networking = {
    privateNetworkEndpoint: "postgres",
    tcpProxies: { "5432": {} },
  };
  const postgresVolume = volume("postgres-volume", {
    alerts: { usage: { "100": {}, "80": {}, "95": {} } },
    allowOnlineResize: true,
    region: "asia-southeast1-eqsg3a",
    sizeMB: 5000,
  });
  const server = service("server", {
    source: github("iamenochchirima/music-city", {
      branch: "main",
      checkSuites: false,
    }),
    build: {
      buildCommand: "pnpm --filter server build",
      buildEnvironment: "V3",
      builder: "RAILPACK",
      watchPatterns: [
        "/server/**",
        "/packages/shared/**",
        "/pnpm-lock.yaml",
        "/package.json",
        "/.railway/**",
      ],
    },
    start: "pnpm --filter server start",
    healthcheck: "/api/v1/health/ready",
    healthcheckTimeout: 300,
    preDeploy: "pnpm --filter server db:migrate",
    replicas: { "asia-southeast1-eqsg3a": 1 },
  });

  const worker = service("media-worker", {
    source: github("iamenochchirima/music-city", {
      branch: "main",
      checkSuites: false,
    }),
    build: {
      buildCommand: "pnpm --filter server build",
      buildEnvironment: "V3",
      builder: "RAILPACK",
      watchPatterns: [
        "/server/**",
        "/packages/shared/**",
        "/pnpm-lock.yaml",
        "/package.json",
        "/.railway/**",
      ],
    },
    start: "pnpm --filter server worker",
    preDeploy: "pnpm --filter server db:migrate",
    replicas: { "asia-southeast1-eqsg3a": 1 },
  });

  const financialWorker = service("financial-worker", {
    source: github("iamenochchirima/music-city", {
      branch: "main",
      checkSuites: false,
    }),
    build: {
      buildCommand: "pnpm --filter server build",
      buildEnvironment: "V3",
      builder: "RAILPACK",
      watchPatterns: [
        "/server/**",
        "/packages/shared/**",
        "/pnpm-lock.yaml",
        "/package.json",
        "/.railway/**",
      ],
    },
    start: "pnpm --filter server worker:financial",
    preDeploy: "pnpm --filter server db:migrate",
    replicas: { "asia-southeast1-eqsg3a": 1 },
  });

  return project("Music City", {
    variables: { managed: false },
    resources: [server, worker, financialWorker, Postgres, postgresVolume],
  });
});
