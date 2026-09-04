import path from "path";

/** Repo / app root. Hostinger and local `npm start` both run with this cwd. */
export function projectRoot(): string {
  return process.env.PROJECT_ROOT ?? process.cwd();
}

export function staticRoot(): string {
  return path.join(projectRoot(), "static");
}

export function resourcesRoot(): string {
  return path.join(projectRoot(), "resources");
}

export function outRoot(): string {
  return path.join(projectRoot(), "out");
}
