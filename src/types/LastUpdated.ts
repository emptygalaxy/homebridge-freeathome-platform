import {Formats, Perms} from 'hap-nodejs';

let LastUpdated;
export function CreateLastUpdated(Characteristic): typeof LastUpdated {
  LastUpdated = class extends Characteristic {
    static readonly UUID: string = '00000023-0000-1000-8000-656261617577';

    constructor() {
      super('Last Updated', LastUpdated.UUID);

      this.setProps({
        format: Formats.STRING,
        perms: [Perms.PAIRED_READ, Perms.NOTIFY],
      });

      this.value = this.getDefaultValue();
    }
  };

  return LastUpdated;
}