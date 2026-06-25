import {MAVLinkMessage} from '../node-mavlink-shim';
/*
// Live ESC configuration echoed by the FC. crc_extra=55.
*/
export class SckyEscConfig extends MAVLinkMessage {
	public cur_scale!: number;
	public cur_offset!: number;
	public refresh_hz!: number;
	public protocol!: number;
	public master_enabled!: number;
	public bidir!: number;
	public dir_mask!: number;
	public pole_count!: number;
	public mode3d_mask!: number;
	public _message_id: number = 42011;
	public _message_name: string = 'SCKY_ESC_CONFIG';
	public _crc_extra: number = 55;
	public _message_fields: [string, string, boolean][] = [
		['cur_scale', 'float', false],
		['cur_offset', 'float', false],
		['refresh_hz', 'uint16_t', false],
		['protocol', 'uint8_t', false],
		['master_enabled', 'uint8_t', false],
		['bidir', 'uint8_t', false],
		['dir_mask', 'uint8_t', false],
		['pole_count', 'uint8_t', false],
		['mode3d_mask', 'uint8_t', false],
	];
}
