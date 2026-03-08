import { Image } from 'react-native';

interface LoadingDSIconProps {
  width?: number;
  height?: number;
}

const LoadingDSIcon = (props: LoadingDSIconProps) => {
  return (
    <Image
      source={require('@/assets/images/ds-loading.gif')}
      style={{
        width: props.width ?? 100,
        height: props.height ?? 100,
      }}
    />
  );
};

export default LoadingDSIcon;
