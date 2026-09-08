import Matter from 'matter-js';
import { JAR_BOTTOM, JAR_X0, JAR_X1, NECK_X0, NECK_X1, NECK_Y, SHOULDER_Y, STEP_MS, WORLD_H } from './constants';
import { fruit } from './fruits';
import type { Pair } from './merge';

const { Engine, Bodies, Body, Composite, Events, Vector, Vertices } = Matter;

export interface FruitData {
  tier: number;
  id: number;
  born: number;
}

export type FruitBody = Matter.Body & { plugin: FruitData };

export function isFruit(b: Matter.Body): b is FruitBody {
  return b.label === 'fruit';
}

/** Static convex polygon placed exactly where its vertices say. */
function shoulder(verts: Matter.Vector[], opts: Matter.IBodyDefinition): Matter.Body {
  const c = Vertices.centre(verts);
  return Bodies.fromVertices(c.x, c.y, [verts], opts);
}

/** Thin wrapper around a matter-js engine holding the jar walls and the fruit bodies. */
export class Physics {
  readonly engine: Matter.Engine;
  readonly fruits = new Map<number, FruitBody>();
  /** Same-tier contacts collected during the last update; consumed by the game. */
  pending: Pair<FruitBody>[] = [];
  onImpact: ((body: FruitBody, strength: number) => void) | null = null;
  private nextId = 1;

  constructor() {
    this.engine = Engine.create({
      gravity: { x: 0, y: 1.4, scale: 0.001 },
      enableSleeping: false,
      positionIterations: 8,
      velocityIterations: 6,
    });
    const wallOpts: Matter.IChamferableBodyDefinition = { isStatic: true, friction: 0.5, restitution: 0, label: 'wall' };
    const thick = 80;
    const walls = [
      Bodies.rectangle(JAR_X0 - thick / 2, WORLD_H / 2, thick, WORLD_H * 2, wallOpts),
      Bodies.rectangle(JAR_X1 + thick / 2, WORLD_H / 2, thick, WORLD_H * 2, wallOpts),
      Bodies.rectangle((JAR_X0 + JAR_X1) / 2, JAR_BOTTOM + thick / 2, JAR_X1 - JAR_X0 + thick * 2, thick, wallOpts),
      // Chamfers so nothing wedges in the bottom corners and the floor reads as a curved jar base.
      Bodies.rectangle(JAR_X0, JAR_BOTTOM, 28, 28, { ...wallOpts, angle: Math.PI / 4 }),
      Bodies.rectangle(JAR_X1, JAR_BOTTOM, 28, 28, { ...wallOpts, angle: Math.PI / 4 }),
      // Shoulders: the neck is narrower than the body, so slope in from the body wall to the neck wall.
      shoulder([{ x: JAR_X0, y: SHOULDER_Y }, { x: NECK_X0, y: NECK_Y }, { x: NECK_X0, y: -WORLD_H }, { x: JAR_X0 - thick, y: -WORLD_H }, { x: JAR_X0 - thick, y: SHOULDER_Y }], wallOpts),
      shoulder([{ x: JAR_X1, y: SHOULDER_Y }, { x: NECK_X1, y: NECK_Y }, { x: NECK_X1, y: -WORLD_H }, { x: JAR_X1 + thick, y: -WORLD_H }, { x: JAR_X1 + thick, y: SHOULDER_Y }], wallOpts),
    ];
    Composite.add(this.engine.world, walls);

    const collect = (e: Matter.IEventCollision<Matter.Engine>, start: boolean) => {
      for (const pair of e.pairs) {
        const a = pair.bodyA;
        const b = pair.bodyB;
        if (!isFruit(a) || !isFruit(b)) {
          if (start && this.onImpact) {
            const f = isFruit(a) ? a : isFruit(b) ? b : null;
            if (f) this.onImpact(f, Vector.magnitude(f.velocity));
          }
          continue;
        }
        if (start && this.onImpact) {
          const rel = Vector.sub(a.velocity, b.velocity);
          const strength = Math.abs(Vector.dot(rel, pair.collision.normal));
          this.onImpact(a, strength);
          this.onImpact(b, strength);
        }
        if (a.plugin.tier === b.plugin.tier) this.pending.push({ a, b });
      }
    };
    Events.on(this.engine, 'collisionStart', (e) => collect(e, true));
    Events.on(this.engine, 'collisionActive', (e) => collect(e, false));
  }

  spawn(tier: number, x: number, y: number, now: number, velocity?: Matter.Vector): FruitBody {
    const spec = fruit(tier);
    const body = Bodies.circle(x, y, spec.r, {
      restitution: 0.12,
      friction: 0.35,
      frictionStatic: 0.5,
      frictionAir: 0.008,
      density: 0.0015,
      label: 'fruit',
    }) as FruitBody;
    body.plugin = { tier, id: this.nextId++, born: now };
    if (velocity) Body.setVelocity(body, velocity);
    Composite.add(this.engine.world, body);
    this.fruits.set(body.plugin.id, body);
    return body;
  }

  pin(body: FruitBody): void {
    Body.setStatic(body, true);
  }

  remove(body: FruitBody): void {
    if (!this.fruits.delete(body.plugin.id)) return;
    Composite.remove(this.engine.world, body);
  }

  has(body: FruitBody): boolean {
    return this.fruits.has(body.plugin.id);
  }

  clear(): void {
    for (const b of this.fruits.values()) Composite.remove(this.engine.world, b);
    this.fruits.clear();
    this.pending = [];
  }

  /** Advance one fixed step. Same-tier contacts accumulate in `pending`. */
  step(): void {
    Engine.update(this.engine, STEP_MS);
  }
}
