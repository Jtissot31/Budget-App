import { StyleProp, StyleSheet, Text, type TextProps, View, ViewStyle } from 'react-native';

import type { Transaction } from '@/types';

import { singleLineAmountProps } from '@/lib/textLayout';



export type TransactionAmountDirection = 'income' | 'expense' | 'neutral';



/** Income: + prefix. Expense: − prefix. Neutral (e.g. transfer): no prefix. */

export function transactionAmountDirectionPrefix(

  direction: TransactionAmountDirection,

): '+' | '−' | null {

  if (direction === 'income') return '+';

  if (direction === 'expense') return '−';

  return null;

}



export function transactionAmountDirectionFromType(

  type: Transaction['type'] | 'payment' | null | undefined,

): TransactionAmountDirection {

  if (type === 'income') return 'income';

  if (type === 'expense' || type === 'payment') return 'expense';

  return 'neutral';

}



export function recurringPaymentAmountDirection(

  kind?: 'payment' | 'income' | null,

): TransactionAmountDirection {

  if (kind === 'income') return 'income';

  if (kind === 'payment') return 'expense';

  return 'neutral';

}



type Props = {

  amount: string;

  direction: TransactionAmountDirection;

  color: string;

  /** Accepts StyleSheet entries and typography presets without strict TextStyle friction. */

  textStyle?: TextProps['style'] | object;

  iconSize?: number;

  containerStyle?: StyleProp<ViewStyle>;

  showDirectionIcon?: boolean;

};



export function TransactionAmountLabel({

  amount,

  direction,

  color,

  textStyle,

  containerStyle,

  showDirectionIcon = true,

}: Props) {

  const prefix = showDirectionIcon ? transactionAmountDirectionPrefix(direction) : null;

  const displayAmount = prefix ? `${prefix}${amount}` : amount;



  return (

    <View style={[styles.row, containerStyle]}>

      <Text style={[styles.amountText, textStyle as TextProps['style'], { color }]} {...singleLineAmountProps}>

        {displayAmount}

      </Text>

    </View>

  );

}



const styles = StyleSheet.create({

  row: {

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'flex-end',

    flexShrink: 0,

    maxWidth: '100%',

  },

  amountText: {

    flexShrink: 1,

    minWidth: 0,

  },

});


