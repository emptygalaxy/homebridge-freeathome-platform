import {Formats, Perms} from 'hap-nodejs';

let AutomaticOff;
export function CreateAutomaticOff(Characteristic): typeof AutomaticOff
{
    AutomaticOff = class extends Characteristic
    {
        static readonly UUID: string = '72227266-CA42-4442-AB84-0A7D55A0F08D';

        constructor() {
            super('Automatic Off', AutomaticOff.UUID);

            this.setProps({
                format: Formats.BOOL,
                perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE],
            });

            this.value = this.getDefaultValue();
        }
    };

    return AutomaticOff;
}