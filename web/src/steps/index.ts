import type { StepSource } from './stepSource'
import { DeviceMotionStepSource, deviceMotionSupported } from './deviceMotionSource'

export type { StepSource, StepSourceStatus } from './stepSource'

/** The step source for this platform. Only the web source ships today; a native
 *  wrapper would return its OS-pedometer source here instead (see stepSource.ts). */
export function selectStepSource(): StepSource {
  return new DeviceMotionStepSource()
}

/** Whether this device can supply steps at all (gates the Walk Mode toggle). */
export function stepSourceSupported(): boolean {
  return deviceMotionSupported()
}
