import {MAVLinkMessage} from '../node-mavlink-shim';
/*
// Per-motor ESC telemetry (BLHeli32 / KISS) plus aggregate consumption and current. crc_extra=91.
*/
export class SckyEscTelem extends MAVLinkMessage {
	public mah_consumed!: number;
	public analog_current!: number;
	public rpm!: number[];
	public centivolt!: number[];
	public centiamp!: number[];
	public temperature!: number[];
	public error_count!: number[];
	public _message_id: number = 42010;
	public _message_name: string = 'SCKY_ESC_TELEM';
	public _crc_extra: number = 91;
	public _message_fields: [string, string, boolean][] = [
		['mah_consumed', 'float', false],
		['analog_current', 'float', false],
		['rpm', 'int32_t[4]', false],
		['centivolt', 'uint16_t[4]', false],
		['centiamp', 'uint16_t[4]', false],
		['temperature', 'uint8_t[4]', false],
		['error_count', 'uint8_t[4]', false],
	];
}
