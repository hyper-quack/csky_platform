import {MAVLinkMessage} from '../node-mavlink-shim';
import {readInt64LE, readUInt64LE} from '../node-mavlink-shim';
/*
// Status for SCKY IMU.
*/
// time_boot_ms ms since firmware boot uint32_t
// imu_id 0 or 1 uint8_t
// connected MAV_BOOL: 0 or 1 uint8_t
// healthy MAV_BOOL: 0 or 1 uint8_t
// whoami show as hex (for example 0x47) uint8_t
export class SckyImuStatus extends MAVLinkMessage {
	public time_boot_ms!: number;
	public imu_id!: number;
	public connected!: number;
	public healthy!: number;
	public whoami!: number;
	public _message_id: number = 42000;
	public _message_name: string = 'SCKY_IMU_STATUS';
	public _crc_extra: number = 38;
	public _message_fields: [string, string, boolean][] = [
		['time_boot_ms', 'uint32_t', false],
		['imu_id', 'uint8_t', false],
		['connected', 'uint8_t', false],
		['healthy', 'uint8_t', false],
		['whoami', 'uint8_t', false],
	];
}