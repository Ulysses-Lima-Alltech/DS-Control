import { View, type ViewProps, Animated } from 'react-native';
import { useEffect } from 'react';
import { useRef } from 'react';
import { DimensionValue } from 'react-native';

interface SkeletonProps extends ViewProps {
  height: DimensionValue;
  width: DimensionValue;
}

export default function Skeleton({ height = 24, width = 24, ...props }: SkeletonProps) {
  const shimmerAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnimation, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    shimmer.start();

    return () => shimmer.stop();
  }, [shimmerAnimation]);

  const shimmerOpacity = shimmerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View
      style={{
        backgroundColor: '#E5E5EA',
        height: height,
        width: width,
        overflow: 'hidden',
        borderRadius: 4,
      }}
      {...props}
    >
      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#FFFFFF',
          opacity: shimmerOpacity,
        }}
      />
    </View>
  );
}
