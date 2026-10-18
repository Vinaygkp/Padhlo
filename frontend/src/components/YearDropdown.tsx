import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal, 
  FlatList 
} from 'react-native';
import { ChevronDown, Check, Calendar } from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { ACADEMIC_YEARS, AcademicYear } from '@/types';

interface YearDropdownProps {
  selectedYear?: AcademicYear | '';
  onSelectYear: (year: AcademicYear) => void;
  label?: string;
  allowAll?: boolean;
  placeholder?: string;
}

export const YearDropdown: React.FC<YearDropdownProps> = ({
  selectedYear,
  onSelectYear,
  label = 'Academic Year *',
  allowAll = false,
  placeholder = 'Select your academic year',
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  const availableYears = allowAll 
    ? [{ code: 'ALL' as AcademicYear, name: 'All Academic Years (Common)', shortName: 'All Years' }, ...ACADEMIC_YEARS]
    : ACADEMIC_YEARS;

  const currentOption = selectedYear ? availableYears.find((y) => y.code === selectedYear) : undefined;

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setModalVisible(true)}
        style={styles.selectorButton}
      >
        <View style={styles.selectedContent}>
          {currentOption ? (
            <>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{currentOption.shortName}</Text>
              </View>
              <Text style={styles.selectedName} numberOfLines={1}>
                {currentOption.name}
              </Text>
            </>
          ) : (
            <Text style={[styles.selectedName, { color: THEME.textTertiary }]} numberOfLines={1}>
              {placeholder}
            </Text>
          )}
        </View>

        <ChevronDown size={18} color={THEME.blue} />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.headerTitleWrap}>
                <Calendar size={18} color={THEME.blue} />
                <Text style={styles.modalTitle}>Select Academic Year</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>Done</Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={availableYears}
              keyExtractor={(item) => item.code}
              contentContainerStyle={{ paddingBottom: 24 }}
              renderItem={({ item }) => {
                const isSelected = item.code === selectedYear;
                return (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      onSelectYear(item.code);
                      setModalVisible(false);
                    }}
                    style={[
                      styles.yearItem,
                      isSelected && styles.yearItemSelected,
                    ]}
                  >
                    <View style={styles.itemLeft}>
                      <View style={[styles.itemBadge, isSelected && styles.itemBadgeSelected]}>
                        <Text style={[styles.itemBadgeText, isSelected && styles.itemBadgeTextSelected]}>
                          {item.shortName}
                        </Text>
                      </View>
                      <Text style={[styles.itemName, isSelected && styles.itemNameSelected]}>
                        {item.name}
                      </Text>
                    </View>

                    {isSelected && <Check size={18} color={THEME.blue} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    color: THEME.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#121218',
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
    marginRight: 8,
  },
  badge: {
    backgroundColor: THEME.blueMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: THEME.blue + '40',
  },
  badgeText: {
    color: THEME.blue,
    fontSize: 12,
    fontWeight: '800',
  },
  selectedName: {
    color: THEME.textPrimary,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F1017',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: '65%',
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: THEME.surfaceBorder,
    marginBottom: 16,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    color: THEME.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  closeBtnText: {
    color: THEME.blue,
    fontSize: 14,
    fontWeight: '600',
  },
  yearItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#14141E',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  yearItemSelected: {
    backgroundColor: '#181C2A',
    borderColor: THEME.blue,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  itemBadge: {
    backgroundColor: '#20202E',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  itemBadgeSelected: {
    backgroundColor: THEME.blueMuted,
  },
  itemBadgeText: {
    color: THEME.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  itemBadgeTextSelected: {
    color: THEME.blue,
  },
  itemName: {
    color: THEME.textPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  itemNameSelected: {
    color: THEME.blue,
    fontWeight: '700',
  },
});
