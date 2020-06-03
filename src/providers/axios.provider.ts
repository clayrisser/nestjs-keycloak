import axios from 'axios';

export const AXIOS = 'AXIOS';

export const AxiosProvider = {
  inject: [],
  provide: AXIOS,
  useFactory: () => axios
};
