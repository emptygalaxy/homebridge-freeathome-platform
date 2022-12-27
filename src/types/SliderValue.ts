import {Formats, Perms} from 'hap-nodejs';

let SliderValue;
export function CreateSliderValue(Characteristic): typeof SliderValue {
  SliderValue = class extends Characteristic {
    static readonly UUID: string = '38AFD9A5-A0C5-42D9-ACD0-1BE08D4FF3F7';

    constructor() {
      super('Value', SliderValue.UUID);

      this.setProps({
        format: Formats.INT,
        perms: [Perms.PAIRED_READ, Perms.PAIRED_WRITE],
      });

      this.value = this.getDefaultValue();
    }
  };

  return SliderValue;
}