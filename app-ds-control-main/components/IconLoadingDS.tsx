import { Image } from 'react-native';

interface LoadingDSIconProps {
  width?: number;
  height?: number;
}

const LoadingDSIcon = (props: LoadingDSIconProps) => {
  return (
    <Image
      source={require('@/assets/images/logo-icontrol-agras.png')}
      style={{
        width: props.width ?? 180,
        height: props.height ?? 76,
      }}
      resizeMode='contain'
    />
  );
};

export default LoadingDSIcon;
