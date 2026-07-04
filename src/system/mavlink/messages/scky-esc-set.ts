import {MAVLinkMessage} from '../node-mavlink-shim';
/*
// Write the live analog-PWM ESC configuration (ground station -> FC). crc_extra=154.
*/
export class SckyEscSet extends MAVLinkMessage {
	public cur_scale!: number;
	public cur_offset!: number;
	public min_us!: number[];
	public max_us!: number[];
	public pwm_hz!: number;
	public output_map!: number[];
	public master_enabled!: number;
	public _message_id: number = 42012;
	public _message_name: string = 'SCKY_ESC_SET';
	public _crc_extra: number = 154;
	public _message_fields: [string, string, boolean][] = [
		['cur_scale', 'float', false],
		['cur_offset', 'float', false],
		['min_us', 'uint16_t[4]', false],
		['max_us', 'uint16_t[4]', false],
		['pwm_hz', 'uint16_t', false],
		['output_map', 'uint8_t[4]', false],
		['master_enabled', 'uint8_t', false],
	];
}
