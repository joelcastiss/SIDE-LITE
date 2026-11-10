// Local composition only: no listener, credentials, network exposure or deployment.
import express from 'express';
import {createIdentityApp, createTokenVerifier} from './identity.js';
import {createGamesApp} from './games.js';
import {createJoinLimiter} from './join-limiter.js';
import {createCycleControlsRouter} from './cycle-controls.js';
import {createPodiumRouter} from './podium.js';

export function createSideLiteApp({pool, projectUrl, keyResolver} = {}) {
  if (typeof pool?.query !== 'function' || typeof pool?.connect !== 'function') throw new TypeError('Se requiere un pool PostgreSQL.');
  const verifyToken = createTokenVerifier({projectUrl, keyResolver});
  const limitJoin = createJoinLimiter({pool});
  const app = express();
  app.disable('x-powered-by');
  // Both applications fail closed; the game app also rechecks authorization
  // in its database transactions. The first app passes unhandled routes on.
  app.use(createIdentityApp({pool, verifyToken}));
  app.use(createGamesApp({pool, verifyToken, limitJoin}));
  app.use(createCycleControlsRouter({pool, verifyToken}));
  app.use(createPodiumRouter({pool, verifyToken}));
  return app;
}
