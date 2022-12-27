import {CreateSliderValue} from './SliderValue';

let Slider, SliderValue;
export function CreateSlider(Service, Characteristic): typeof Service {
  SliderValue = CreateSliderValue(Characteristic);

  Slider = class extends Service {
    static readonly UUID: string = 'DDFC25B3-3624-44CA-9477-FDC977FC7C81';

    constructor(displayName: string) {
      super(displayName, Slider.UUID);

      // Required Characteristics
      this.addCharacteristic(SliderValue);
    }
  };

  return Slider;
}