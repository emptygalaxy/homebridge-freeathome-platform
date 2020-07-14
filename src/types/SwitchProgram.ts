import {Characteristic, Service, Formats, Perms, Units} from 'hap-nodejs';

export class SwitchProgram extends Service{
    static readonly UUID: string = 'FD92B7CF-A343-4D7E-9467-FD251E22C374';

    constructor(displayName: string) {
        super(displayName, SwitchProgram.UUID);

        // Optional Characteristics
        this.addOptionalCharacteristic(PeriodInSeconds);
        this.addOptionalCharacteristic(AutomaticOff);
    }
}

export class PeriodInSeconds extends Characteristic {
    static readonly UUID: string = 'B469181F-D796-46B4-8D99-5FBE4BA9DC9C';

    constructor() {
        super('Period', PeriodInSeconds.UUID);

        this.setProps({
            format: Formats.INT,
            unit: Units.SECONDS,
            perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE],
            minValue: 1,
            maxValue: 3600,
        });

        this.value = this.getDefaultValue();
    }
}

export class AutomaticOff extends Characteristic {
    static readonly UUID: string = '72227266-CA42-4442-AB84-0A7D55A0F08D';

    constructor() {
        super('Automatic Off', AutomaticOff.UUID);

        this.setProps({
            format: Formats.BOOL,
            perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE],
        });

        this.value = this.getDefaultValue();
    }
}