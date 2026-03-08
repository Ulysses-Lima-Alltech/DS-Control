import Image from 'next/image';

interface LoadingIconProps {
  size?: number;
  width?: number;
  height?: number;
  className?: string;
}

const LoadingIcon = ({ size, width, height, ...props }: LoadingIconProps) => {
  return (
    <Image
      src='/images/ds-loading.gif'
      alt='Loading'
      unoptimized={true}
      width={width ?? size ?? 100}
      height={height ?? size ?? 100}
      {...props}
    />
  );
};

export default LoadingIcon;
