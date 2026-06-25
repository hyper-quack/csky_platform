import {MAVLinkMessage} from '../node-mavlink-shim';
/*
// One-shot DShot special command (ground station -> FC). crc_extra=106.
*/
export class SckyEscCmd extends MAVLinkMessage {
	public value!: number;
	public target!: number;
	public command!: number;
	public _message_id: number = 42013;
	public _message_name: string = 'SCKY_ESC_CMD';
	public _crc_extra: number = 106;
	public _message_fields: [string, string, boolean][] = [
		['value', 'uint16_t', false],
		['target', 'uint8_t', false],
		['command', 'uint8_t', false],
	];
}
