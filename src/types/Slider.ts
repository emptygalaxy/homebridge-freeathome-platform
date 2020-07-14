import {Characteristic, Service, Formats, Perms} from 'hap-nodejs';

export class Slider extends Service {
    static readonly UUID: string = 'DDFC25B3-3624-44CA-9477-FDC977FC7C81';

    constructor(displayName: string) {
        super(displayName, Slider.UUID);

        // Required Characteristics
        this.addCharacteristic(SliderValue);
    }
}

export class SliderValue extends Characteristic {
    static readonly UUID: string = '38AFD9A5-A0C5-42D9-ACD0-1BE08D4FF3F7';

    constructor() {
        super('Value', SliderValue.UUID);

        this.setProps({
            format: Formats.INT,
            perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE],
        });

        this.value = this.getDefaultValue();
    }
}