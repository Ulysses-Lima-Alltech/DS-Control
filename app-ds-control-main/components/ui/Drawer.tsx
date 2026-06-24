import React, { useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated, Dimensions } from 'react-native';

import { COLORS, SHADOWS } from '@/constants/colors';

export type DrawerProps = {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  isLandscape?: boolean;
  position?: 'left' | 'right' | 'top' | 'bottom';
};

export default function Drawer({
  title,
  children,
  defaultOpen = false,
  isLandscape = false,
  position = 'left',
}: DrawerProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const animationValue = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  const toggleDrawer = () => {
    const toValue = isOpen ? 0 : 1;

    Animated.timing(animationValue, {
      toValue,
      duration: 300,
      useNativeDriver: false,
    }).start();

    setIsOpen(!isOpen);
  };

  const getArrowRotation = () => {
    if (position === 'top') {
      return isOpen ? '-90deg' : '90deg';
    }
    if (position === 'bottom') {
      return isOpen ? '90deg' : '-90deg';
    }
    if (position === 'left') {
      return isOpen ? '180deg' : '0deg';
    }
    if (position === 'right') {
      return isOpen ? '0deg' : '180deg';
    }
    return '0deg';
  };

  const getAnimatedWidth = () => {
    if (isLandscape && (position === 'left' || position === 'right')) {
      return animationValue.interpolate({
        inputRange: [0, 1],
        outputRange: [50, screenWidth * 0.3],
      });
    }
    return undefined;
  };

  const getAnimatedHeight = () => {
    if (!isLandscape && (position === 'top' || position === 'bottom')) {
      return animationValue.interpolate({
        inputRange: [0, 1],
        outputRange: [50, screenHeight * 0.4],
      });
    }
    return undefined;
  };

  const baseStyle: any = {
    width: getAnimatedWidth(),
    height: getAnimatedHeight(),
  };

  if (isLandscape && (position === 'left' || position === 'right')) {
    baseStyle.height = '100%';
  }
  if (!isLandscape && (position === 'top' || position === 'bottom')) {
    baseStyle.width = '100%';
  }

  const containerStyle = [
    styles.container,
    position === 'left' && styles.leftPosition,
    position === 'right' && styles.rightPosition,
    position === 'top' && styles.topPosition,
    position === 'bottom' && styles.bottomPosition,
    baseStyle,
  ];

  const contentOpacity = animationValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <Animated.View style={containerStyle}>
      <TouchableOpacity
        style={[
          styles.header,
          position === 'top' && styles.headerHorizontal,
          position === 'bottom' && styles.headerHorizontal,
          isLandscape &&
            (position === 'left' || position === 'right') &&
            !isOpen &&
            styles.headerLandscapeClosed,
        ]}
        onPress={toggleDrawer}
        activeOpacity={0.7}
      >
        <Animated.Text
          style={[
            styles.headerTitle,
            { opacity: isLandscape ? (isOpen ? 1 : 0) : 1 },
            isLandscape && !isOpen && styles.hiddenTitle,
          ]}
          numberOfLines={1}
        >
          {title}
        </Animated.Text>

        <View style={styles.arrowContainer}>
          <Animated.Text style={[styles.arrow, { transform: [{ rotate: getArrowRotation() }] }]}>
            ▶
          </Animated.Text>
        </View>
      </TouchableOpacity>

      <Animated.View
        style={[styles.content, { opacity: contentOpacity }]}
        pointerEvents={isOpen ? 'auto' : 'none'}
      >
        {children}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
    overflow: 'hidden',
  },
  leftPosition: {
    alignSelf: 'flex-start',
  },
  rightPosition: {
    alignSelf: 'flex-end',
  },
  topPosition: {
    alignSelf: 'stretch',
  },
  bottomPosition: {
    alignSelf: 'stretch',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: COLORS.primarySoft,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    minHeight: 50,
  },
  headerLandscapeClosed: {
    height: '100%',
    justifyContent: 'center',
  },
  headerHorizontal: {
    flexDirection: 'row',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  hiddenTitle: {
    width: 0,
    overflow: 'hidden',
  },
  arrowContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    fontSize: 12,
    color: COLORS.primaryDark,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
});
