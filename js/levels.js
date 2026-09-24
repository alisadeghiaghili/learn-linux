/**
 * Level catalog index — sequences and merged packs.
 */

import { coreLevels, homeTreeSpec } from './levels-core.js';
import { textLevels } from './levels-text.js';
import {
  permLevels,
  adminLevels,
  procLevels,
  fsLevels,
  pkgLevels,
  netLevels,
  secLevels,
  svcLevels,
  shellLevels,
} from './levels-advanced.js';
import { gapLevels } from './levels-gap.js';
import { polishLevels } from './levels-polish.js';
import { enrichLevels } from './levels-enrich.js';

export { homeTreeSpec as homeTree };

/** @type {any[]} */
export const levels = enrichLevels([
  ...coreLevels,
  ...textLevels,
  ...permLevels,
  ...adminLevels,
  ...procLevels,
  ...fsLevels,
  ...pkgLevels,
  ...netLevels,
  ...secLevels,
  ...svcLevels,
  ...shellLevels,
  ...gapLevels,
  ...polishLevels,
]);

/** @type {{id: string, name: string, about: string}[]} */
export const sequences = [
  {
    id: 'intro',
    name: 'Introduction',
    about: 'Identity (whoami/id), paths, listing, navigation, stdout — first contact.',
  },
  {
    id: 'files',
    name: 'Files & directories',
    about: 'Inodes and names: mkdir, touch, cat, cp, mv, rm.',
  },
  {
    id: 'text',
    name: 'Text, streams & filters',
    about: 'Redirection, pipes, exit codes, grep, sort, uniq, cut, sed, awk, tee.',
  },
  {
    id: 'permissions',
    name: 'Permissions',
    about: 'rwx, octal/special bits, umask, ownership, chown.',
  },
  {
    id: 'admin',
    name: 'Users & admin',
    about: 'passwd/group, useradd, usermod, sudo, cron, FHS.',
  },
  {
    id: 'processes',
    name: 'Processes & signals',
    about: 'ps, top, kill, signals, jobs.',
  },
  {
    id: 'system',
    name: 'Filesystems & devices',
    about: 'find, links, stat, df, du, mount, lsblk, uname, dmesg, env.',
  },
  {
    id: 'packages',
    name: 'Package management',
    about: 'apt update/install/remove/policy, dpkg.',
  },
  {
    id: 'networking',
    name: 'Networking',
    about: 'ip, ifconfig, ss, ping, curl, hosts, DNS.',
  },
  {
    id: 'security',
    name: 'Security',
    about: 'Least privilege, sudo, secrets, audit logs, passwords.',
  },
  {
    id: 'services',
    name: 'Services & scheduling',
    about: 'systemctl, journalctl, cron.',
  },
  {
    id: 'shell',
    name: 'Shell & scripting',
    about: 'Variables, which/type, man, scripts, &&/||.',
  },
];

/**
 * @param {string} sequenceId
 */
export function levelsIn(sequenceId) {
  return levels.filter((l) => l.sequence === sequenceId);
}

/**
 * @param {string} id
 */
export function getLevel(id) {
  return levels.find((l) => l.id === id);
}
