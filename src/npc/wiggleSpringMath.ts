import * as THREE from 'three';

const UP_Y = new THREE.Vector3(0, 1, 0);
const FIXED_STEP = 1 / 120;

const _tmpQ = new THREE.Quaternion();
const _invQ = new THREE.Quaternion();
const _errQ = new THREE.Quaternion();
const _deltaQ = new THREE.Quaternion();
const _errVec = new THREE.Vector3();
const _accel = new THREE.Vector3();
const _axis = new THREE.Vector3();

export function computeRestQuat(originPosition: THREE.Vector3): THREE.Quaternion {
  if (originPosition.lengthSq() > 1e-8) {
    return new THREE.Quaternion().setFromUnitVectors(
      UP_Y,
      originPosition.clone().normalize()
    );
  }
  return new THREE.Quaternion();
}

export function clampQuatFromRest(
  q: THREE.Quaternion,
  rest: THREE.Quaternion,
  maxAngleRad: number
): void {
  const ang = q.angleTo(rest);
  if (ang > maxAngleRad && ang > 1e-6) {
    _tmpQ.copy(q);
    q.copy(rest).slerp(_tmpQ, maxAngleRad / ang);
  }
}

export function stepAngularSpring(
  simQuat: THREE.Quaternion,
  angVel: THREE.Vector3,
  targetQuat: THREE.Quaternion,
  omegaN: number,
  zeta: number,
  dt: number
): void {
  if (dt <= 0) return;
  const substeps = Math.max(1, Math.min(48, Math.ceil(dt / FIXED_STEP)));
  const h = dt / substeps;
  const k = omegaN * omegaN;
  const c = 2 * zeta * omegaN;

  for (let i = 0; i < substeps; i++) {
    _invQ.copy(simQuat).invert();
    _errQ.multiplyQuaternions(targetQuat, _invQ);
    if (_errQ.w < 0) {
      _errQ.set(-_errQ.x, -_errQ.y, -_errQ.z, -_errQ.w);
    }

    const wClamped = THREE.MathUtils.clamp(_errQ.w, -1, 1);
    const angle = 2 * Math.acos(wClamped);
    const sinHalf = Math.sqrt(Math.max(0, 1 - wClamped * wClamped));
    if (sinHalf > 1e-6 && angle > 1e-7) {
      const s = angle / sinHalf;
      _errVec.set(_errQ.x * s, _errQ.y * s, _errQ.z * s);
    } else {
      _errVec.set(_errQ.x * 2, _errQ.y * 2, _errQ.z * 2);
    }

    _accel.copy(_errVec).multiplyScalar(k).addScaledVector(angVel, -c);
    angVel.addScaledVector(_accel, h);

    const speed = angVel.length();
    if (speed > 1e-7) {
      _axis.copy(angVel).divideScalar(speed);
      _deltaQ.setFromAxisAngle(_axis, speed * h);
      simQuat.premultiply(_deltaQ).normalize();
    }
  }
}
