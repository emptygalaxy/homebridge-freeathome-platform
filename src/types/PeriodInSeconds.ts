import {Formats, Perms, Units} from 'hap-nodejs';

let PeriodInSeconds;
export function CreatePeriodInSeconds(Characteristic): typeof PeriodInSeconds {
  PeriodInSeconds = class extends Characteristic {
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
  };

  return PeriodInSeconds;
}