import * as THREE from "three";
import { SimObject } from "../SimObject";
import { SimRobotDrivetrain } from "./SimRobotDrivetrain";
import {
  World,
  Vec2,
  Box,
  BodyDef,
  FixtureDef,
  PrismaticJoint,
} from "planck-js";
import { IRobotSpec } from "../../specs/RobotSpecs";

const ROBOT_DEFAULT_COLOR = 0x00ff00;

/**
 * Class representing a controllable simulated robot
 *
 * This class should NEVER be instantiated outside of the Sim3D environment.
 * These objects are generated by the simulator infrastructure automatically.
 *
 * To interact with a simulated robot, use the `addRobot()` method on {@link Sim3D}
 * and use the {@link RobotHandle} that it returns.
 */
export class SimRobot extends SimObject {
  private _bodySpecs: BodyDef;
  private _fixtureSpecs: FixtureDef;

  private _drivetrain: SimRobotDrivetrain;

  constructor(spec: IRobotSpec) {
    super("SimRobot");

    const color =
      spec.baseColor !== undefined ? spec.baseColor : ROBOT_DEFAULT_COLOR;
    const bodyGeom = new THREE.BoxGeometry(
      spec.dimensions.x,
      spec.dimensions.y,
      spec.dimensions.z
    );
    const bodyMaterial = new THREE.MeshStandardMaterial({ color });
    const bodyMesh = new THREE.Mesh(bodyGeom, bodyMaterial);

    this._mesh = bodyMesh;

    const bodyPos: Vec2 = new Vec2(0, 0);
    if (spec.initialPosition) {
      bodyPos.x = spec.initialPosition.x;
      bodyPos.y = spec.initialPosition.y;
    }

    this._bodySpecs = {
      type: "dynamic",
      position: bodyPos,
      angle: 0,
      linearDamping: 0.5,
      bullet: true,
      angularDamping: 0.3,
    };

    this._fixtureSpecs = {
      shape: new Box(spec.dimensions.x / 2, spec.dimensions.z / 2),
      density: 1,
      isSensor: false,
      friction: 0.3,
      restitution: 0.4,
    };

    // Configure the drivetrain
    this._drivetrain = new SimRobotDrivetrain(spec);

    // Add the created wheels as children
    this._drivetrain.wheelObjects.forEach((wheel) => {
      this.addChild(wheel);
    });

    // Adjust our base mesh up
    this._mesh.translateY(-this._drivetrain.yOffset);
  }

  update(ms: number): void {
    // This will let the drivetrain update motor forces
    this._drivetrain.update();

    this._children.forEach((childObj) => {
      childObj.update(ms);
    });

    // Update the mesh
    const bodyCenter = this._body.getWorldCenter();
    this._mesh.position.x = bodyCenter.x;
    this._mesh.position.z = bodyCenter.y;

    this._mesh.rotation.y = -this._body.getAngle();
  }

  configureFixtureLinks(world: World): void {
    this._drivetrain.wheelObjects.forEach((wheel) => {
      world.createJoint(
        new PrismaticJoint(
          {
            enableLimit: true,
            lowerTranslation: 0,
            upperTranslation: 0,
          },
          this._body,
          wheel.body,
          wheel.body.getWorldCenter(),
          new Vec2(1, 0)
        )
      );
    });
  }

  // External facing API
  setMotorPower(channel: number, value: number): void {
    this._drivetrain.setMotorPower(channel, value);
  }

  getBodySpecs(): BodyDef {
    return this._bodySpecs;
  }

  getFixtureDef(): FixtureDef {
    return this._fixtureSpecs;
  }
}
