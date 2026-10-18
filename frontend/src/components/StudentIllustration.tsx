import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { 
  Rect, 
  Circle, 
  Path, 
  G, 
  Defs, 
  LinearGradient, 
  Stop 
} from 'react-native-svg';

interface StudentIllustrationProps {
  width?: number;
  height?: number;
}

export const StudentIllustration: React.FC<StudentIllustrationProps> = ({
  width = 140,
  height = 140,
}) => {
  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height} viewBox="0 0 200 200" fill="none">
        <Defs>
          {/* Neon Glow Linear Gradients */}
          <LinearGradient id="laptopGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#38BDF8" />
            <Stop offset="100%" stopColor="#A855F7" />
          </LinearGradient>
          <LinearGradient id="studentShirt" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#A855F7" />
            <Stop offset="100%" stopColor="#7E22CE" />
          </LinearGradient>
          <LinearGradient id="bookCover" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="#F472B6" />
            <Stop offset="100%" stopColor="#A855F7" />
          </LinearGradient>
          <LinearGradient id="glowBack" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#38BDF830" />
            <Stop offset="100%" stopColor="#F472B620" />
          </LinearGradient>
        </Defs>

        {/* Ambient Halo Behind Student */}
        <Circle cx="100" cy="100" r="85" fill="url(#glowBack)" />
        <Circle cx="100" cy="95" r="72" fill="#17171F" stroke="#292933" strokeWidth="2" />

        {/* Floating Idea Sparks */}
        <Circle cx="50" cy="45" r="3" fill="#22D3EE" />
        <Circle cx="155" cy="50" r="3.5" fill="#FBBF24" />
        <Circle cx="165" cy="75" r="2.5" fill="#F472B6" />
        <Circle cx="35" cy="80" r="2" fill="#A855F7" />

        {/* Study Desk */}
        <Rect x="20" y="145" width="160" height="12" rx="6" fill="#292933" />
        <Rect x="25" y="157" width="150" height="4" rx="2" fill="#1C1C24" />

        {/* Stack of Books on Desk */}
        <G>
          <Rect x="35" y="132" width="36" height="6" rx="2" fill="#38BDF8" />
          <Rect x="38" y="125" width="32" height="6" rx="2" fill="#F472B6" />
          <Rect x="36" y="118" width="35" height="6" rx="2" fill="#FBBF24" />
        </G>

        {/* Student Body */}
        {/* Hair Back */}
        <Circle cx="105" cy="65" r="23" fill="#1E1B4B" />

        {/* Torso & Hoodie */}
        <Path
          d="M78 145 C78 115, 84 98, 105 98 C126 98, 132 115, 132 145 Z"
          fill="url(#studentShirt)"
        />

        {/* Neck */}
        <Rect x="100" y="86" width="10" height="14" rx="3" fill="#FCD34D" />

        {/* Student Face */}
        <Circle cx="105" cy="72" r="17" fill="#FDE68A" />

        {/* Hair Front Bangs */}
        <Path
          d="M88 68 C88 53, 122 53, 122 68 C115 62, 110 63, 105 66 C100 63, 94 62, 88 68 Z"
          fill="#312E81"
        />

        {/* Friendly Expression & Glasses */}
        {/* Glasses frames */}
        <Circle cx="99" cy="72" r="5" fill="none" stroke="#22D3EE" strokeWidth="1.5" />
        <Circle cx="111" cy="72" r="5" fill="none" stroke="#22D3EE" strokeWidth="1.5" />
        <Path d="M104 72 L106 72" stroke="#22D3EE" strokeWidth="1.5" />
        {/* Happy smile */}
        <Path d="M101 79 Q105 83 109 79" fill="none" stroke="#78350F" strokeWidth="1.5" strokeLinecap="round" />

        {/* Desk Lamp Glowing */}
        <Path d="M155 145 L155 105 L145 95" stroke="#FBBF24" strokeWidth="3" strokeLinecap="round" />
        <Path d="M138 90 L152 100 L140 106 Z" fill="#FBBF24" />
        <Circle cx="140" cy="100" r="8" fill="#FDE68A" opacity="0.3" />

        {/* Laptop Screen with Code / Study Slides */}
        {/* Laptop Base */}
        <Rect x="85" y="141" width="40" height="4" rx="2" fill="#E2E8F0" />
        {/* Open Display */}
        <Path d="M88 141 L92 118 L126 118 L122 141 Z" fill="#0F172A" stroke="#38BDF8" strokeWidth="1.2" />
        {/* Glowing Screen Content */}
        <Rect x="94" y="121" width="26" height="16" rx="2" fill="url(#laptopGrad)" opacity="0.9" />
        <Rect x="96" y="124" width="16" height="2" rx="1" fill="#FFFFFF" />
        <Rect x="96" y="128" width="22" height="2" rx="1" fill="#FFFFFF" opacity="0.8" />
        <Rect x="96" y="132" width="12" height="2" rx="1" fill="#34D399" />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
