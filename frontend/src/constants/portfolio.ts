import { Linking } from 'react-native';

export const PORTFOLIO_URL = 'https://portfolio-hazel-five-31.vercel.app/';

export const openPortfolio = () => {
  Linking.openURL(PORTFOLIO_URL).catch((err) => {
    console.warn('Could not open portfolio URL:', err);
  });
};
